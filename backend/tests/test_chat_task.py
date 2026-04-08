"""
Tests for Chat Task Service

测试后台任务创建、状态管理、消息持久化等功能。
"""
import pytest
import pytest_asyncio
import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.database import Base
from app.models import User, Session, Message, ChatTask
from app.services.chat_task_service import ChatTaskManager, chat_task_manager


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_chat_task.db"


@pytest_asyncio.fixture
async def test_db():
    """Create test database"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    yield async_session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def test_user(test_db):
    """Create test user"""
    async with test_db() as db:
        user = User(
            email="test@example.com",
            username="testuser",
            password_hash="hashed_password",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        yield user


@pytest_asyncio.fixture
async def test_session(test_db, test_user):
    """Create test session"""
    async with test_db() as db:
        session = Session(
            user_id=test_user.id,
            title="Test Session",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        yield session


@pytest_asyncio.fixture
async def test_message(test_db, test_session):
    """Create test message"""
    async with test_db() as db:
        message = Message(
            session_id=test_session.id,
            role="assistant",
            content={"type": "text", "text": ""},
            status="streaming",
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        yield message


class TestChatTaskManager:
    """Test ChatTaskManager class"""

    @pytest.mark.asyncio
    async def test_create_task(self, test_db, test_user, test_session, test_message):
        """Should create a new chat task"""
        async with test_db() as db:
            manager = ChatTaskManager()
            task = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )

            assert task.id is not None
            assert task.status == "pending"
            assert task.session_id == test_session.id
            assert task.message_id == test_message.id
            assert task.user_id == test_user.id

    @pytest.mark.asyncio
    async def test_subscribe_and_broadcast(self, test_db, test_user, test_session, test_message):
        """Should subscribe to task events and receive broadcasts"""
        async with test_db() as db:
            manager = ChatTaskManager()
            task = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )

            # Subscribe
            queue = await manager.subscribe(task.id)

            # Broadcast an event
            test_event = {"event": "text", "data": '{"content": "Hello"}'}
            await manager.broadcast(task.id, test_event)

            # Receive the event
            received = await asyncio.wait_for(queue.get(), timeout=1.0)
            assert received == test_event

            # Cleanup
            await manager.unsubscribe(task.id, queue)

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, test_db, test_user, test_session, test_message):
        """Should broadcast to multiple subscribers"""
        async with test_db() as db:
            manager = ChatTaskManager()
            task = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )

            # Multiple subscribers
            queue1 = await manager.subscribe(task.id)
            queue2 = await manager.subscribe(task.id)

            # Broadcast
            test_event = {"event": "text", "data": '{"content": "Test"}'}
            await manager.broadcast(task.id, test_event)

            # Both should receive
            received1 = await asyncio.wait_for(queue1.get(), timeout=1.0)
            received2 = await asyncio.wait_for(queue2.get(), timeout=1.0)

            assert received1 == test_event
            assert received2 == test_event

            # Cleanup
            await manager.unsubscribe(task.id, queue1)
            await manager.unsubscribe(task.id, queue2)

    @pytest.mark.asyncio
    async def test_cancel_task(self, test_db, test_user, test_session, test_message):
        """Should cancel a task"""
        async with test_db() as db:
            manager = ChatTaskManager()
            task = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )

            # Cancel
            cancelled = await manager.cancel_task(db, task.id)
            assert cancelled is True

            # Verify status
            await db.refresh(task)
            assert task.status == "cancelled"
            assert task.completed_at is not None

    @pytest.mark.asyncio
    async def test_get_task_status(self, test_db, test_user, test_session, test_message):
        """Should get task status"""
        async with test_db() as db:
            manager = ChatTaskManager()
            created_task = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )

            # Get status
            task = await manager.get_task_status(db, created_task.id)
            assert task is not None
            assert task.id == created_task.id
            assert task.status == "pending"

    @pytest.mark.asyncio
    async def test_get_running_task_for_session(self, test_db, test_user, test_session, test_message):
        """Should get running task for a session"""
        async with test_db() as db:
            manager = ChatTaskManager()
            task = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )

            # Update status to running
            task.status = "running"
            await db.commit()

            # Get running task
            running_task = await manager.get_running_task_for_session(
                db=db,
                session_id=test_session.id,
                user_id=test_user.id,
            )

            assert running_task is not None
            assert running_task.id == task.id

    @pytest.mark.asyncio
    async def test_cleanup_completed_tasks(self, test_db, test_user, test_session, test_message):
        """Should cleanup old completed tasks"""
        async with test_db() as db:
            manager = ChatTaskManager()

            # Create multiple tasks
            task1 = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )
            task2 = await manager.create_task(
                db=db,
                user_id=test_user.id,
                session_id=test_session.id,
                message_id=test_message.id,
            )

            # Mark one as completed (old)
            task1.status = "completed"
            task1.completed_at = datetime.utcnow()
            await db.commit()

            # Mark one as running (should not be cleaned)
            task2.status = "running"
            await db.commit()

            # Cleanup (with 0 hours to clean immediately)
            await manager.cleanup_completed_tasks(db, max_age_hours=0)

            # Verify task1 is deleted, task2 remains
            from sqlalchemy import select
            result = await db.execute(select(ChatTask))
            remaining_tasks = result.scalars().all()

            assert len(remaining_tasks) == 1
            assert remaining_tasks[0].id == task2.id


class TestChatTaskModel:
    """Test ChatTask model"""

    @pytest.mark.asyncio
    async def test_task_creation(self, test_db, test_user, test_session, test_message):
        """Should create task with correct fields"""
        async with test_db() as db:
            task = ChatTask(
                session_id=test_session.id,
                message_id=test_message.id,
                user_id=test_user.id,
                status="pending",
            )
            db.add(task)
            await db.commit()
            await db.refresh(task)

            assert task.id is not None
            assert task.status == "pending"
            assert task.created_at is not None
            assert task.updated_at is None
            assert task.completed_at is None
            assert task.error_message is None

    @pytest.mark.asyncio
    async def test_task_status_transitions(self, test_db, test_user, test_session, test_message):
        """Should allow status transitions"""
        async with test_db() as db:
            task = ChatTask(
                session_id=test_session.id,
                message_id=test_message.id,
                user_id=test_user.id,
                status="pending",
            )
            db.add(task)
            await db.commit()

            # pending -> running
            task.status = "running"
            await db.commit()

            # running -> completed
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            await db.commit()

            await db.refresh(task)
            assert task.status == "completed"
            assert task.completed_at is not None

    @pytest.mark.asyncio
    async def test_task_relationships(self, test_db, test_user, test_session, test_message):
        """Should have correct relationships"""
        async with test_db() as db:
            task = ChatTask(
                session_id=test_session.id,
                message_id=test_message.id,
                user_id=test_user.id,
                status="pending",
            )
            db.add(task)
            await db.commit()
            await db.refresh(task)

            # Verify foreign keys are set correctly
            assert task.session_id == test_session.id
            assert task.message_id == test_message.id
            assert task.user_id == test_user.id


class TestMessageStatus:
    """Test Message status field"""

    @pytest.mark.asyncio
    async def test_message_status_field(self, test_db, test_session):
        """Should support all message statuses"""
        async with test_db() as db:
            statuses = ["pending", "streaming", "completed", "error", "cancelled"]

            for status in statuses:
                message = Message(
                    session_id=test_session.id,
                    role="assistant",
                    content={"type": "text", "text": "test"},
                    status=status,
                )
                db.add(message)

            await db.commit()

            # Verify all statuses are saved correctly
            from sqlalchemy import select
            result = await db.execute(
                select(Message).where(Message.session_id == test_session.id)
            )
            messages = result.scalars().all()

            saved_statuses = [m.status for m in messages]
            for status in statuses:
                assert status in saved_statuses