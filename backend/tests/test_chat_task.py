"""
Tests for Chat Task Service - MongoDB/Beanie Version

测试后台任务创建、状态管理、消息持久化等功能。
"""
import pytest
import pytest_asyncio
import asyncio
from datetime import datetime

from app.core.database import init_db, close_db
from app.models import User, Session, Message, ChatTask
from app.services.chat_task_service import ChatTaskManager


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Setup database connection - runs for each test function"""
    await init_db()
    yield
    await close_db()


@pytest_asyncio.fixture
async def test_user():
    """Create test user"""
    # Clean up first
    existing = await User.find_one(User.email == "task_test@example.com")
    if existing:
        await existing.delete()

    user = User(
        email="task_test@example.com",
        username="task_testuser",
        password_hash="hashed_password",
    )
    await user.insert()
    yield user
    await user.delete()


@pytest_asyncio.fixture
async def test_session(test_user):
    """Create test session"""
    session = Session(
        user_id=test_user.id,
        title="Test Session",
    )
    await session.insert()
    yield session
    await session.delete()


@pytest_asyncio.fixture
async def test_message(test_session):
    """Create test message"""
    message = Message(
        session_id=test_session.id,
        role="assistant",
        content={"type": "text", "text": ""},
        status="streaming",
    )
    await message.insert()
    yield message
    await message.delete()


class TestChatTaskManager:
    """Test ChatTaskManager class"""

    @pytest.mark.asyncio
    async def test_create_task(self, test_user, test_session, test_message):
        """Should create a new chat task"""
        manager = ChatTaskManager()
        task = await manager.create_task(
            user_id=test_user.id,
            session_id=test_session.id,
            message_id=test_message.id,
        )

        assert task.id is not None
        assert task.status == "pending"
        assert task.session_id == test_session.id
        assert task.message_id == test_message.id
        assert task.user_id == test_user.id

        await task.delete()

    @pytest.mark.asyncio
    async def test_subscribe_and_broadcast(self, test_user, test_session, test_message):
        """Should subscribe to task events and receive broadcasts"""
        manager = ChatTaskManager()
        task = await manager.create_task(
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
        await task.delete()

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, test_user, test_session, test_message):
        """Should broadcast to multiple subscribers"""
        manager = ChatTaskManager()
        task = await manager.create_task(
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
        await task.delete()

    @pytest.mark.asyncio
    async def test_cancel_task(self, test_user, test_session, test_message):
        """Should cancel a task"""
        manager = ChatTaskManager()
        task = await manager.create_task(
            user_id=test_user.id,
            session_id=test_session.id,
            message_id=test_message.id,
        )

        # Cancel
        cancelled = await manager.cancel_task(task.id)
        assert cancelled is True

        # Verify status
        await task.sync()
        assert task.status == "cancelled"
        assert task.completed_at is not None

        await task.delete()

    @pytest.mark.asyncio
    async def test_get_task_status(self, test_user, test_session, test_message):
        """Should get task status"""
        manager = ChatTaskManager()
        created_task = await manager.create_task(
            user_id=test_user.id,
            session_id=test_session.id,
            message_id=test_message.id,
        )

        # Get status
        task = await manager.get_task_status(created_task.id)
        assert task is not None
        assert task.id == created_task.id
        assert task.status == "pending"

        await created_task.delete()

    @pytest.mark.asyncio
    async def test_get_running_task_for_session(self, test_user, test_session, test_message):
        """Should get running task for a session"""
        manager = ChatTaskManager()
        task = await manager.create_task(
            user_id=test_user.id,
            session_id=test_session.id,
            message_id=test_message.id,
        )

        # Update status to running
        task.status = "running"
        await task.save()

        # Get running task
        running_task = await manager.get_running_task_for_session(
            session_id=test_session.id,
            user_id=test_user.id,
        )

        assert running_task is not None
        assert running_task.id == task.id

        await task.delete()

    @pytest.mark.asyncio
    async def test_cleanup_completed_tasks(self, test_user, test_session, test_message):
        """Should cleanup old completed tasks"""
        manager = ChatTaskManager()

        # Create multiple tasks
        task1 = await manager.create_task(
            user_id=test_user.id,
            session_id=test_session.id,
            message_id=test_message.id,
        )
        task2 = await manager.create_task(
            user_id=test_user.id,
            session_id=test_session.id,
            message_id=test_message.id,
        )

        # Mark one as completed (old)
        task1.status = "completed"
        task1.completed_at = datetime.utcnow()
        await task1.save()

        # Mark one as running (should not be cleaned)
        task2.status = "running"
        await task2.save()

        # Cleanup (with 0 hours to clean immediately)
        await manager.cleanup_completed_tasks(max_age_hours=0)

        # Verify task1 is deleted, task2 remains
        remaining_tasks = await ChatTask.find().to_list()

        assert len(remaining_tasks) == 1
        assert remaining_tasks[0].id == task2.id

        await task2.delete()


class TestChatTaskModel:
    """Test ChatTask model"""

    @pytest.mark.asyncio
    async def test_task_creation(self, test_user, test_session, test_message):
        """Should create task with correct fields"""
        task = ChatTask(
            session_id=test_session.id,
            message_id=test_message.id,
            user_id=test_user.id,
            status="pending",
        )
        await task.insert()

        assert task.id is not None
        assert task.status == "pending"
        assert task.created_at is not None
        assert task.updated_at is None
        assert task.completed_at is None
        assert task.error_message is None

        await task.delete()

    @pytest.mark.asyncio
    async def test_task_status_transitions(self, test_user, test_session, test_message):
        """Should allow status transitions"""
        task = ChatTask(
            session_id=test_session.id,
            message_id=test_message.id,
            user_id=test_user.id,
            status="pending",
        )
        await task.insert()

        # pending -> running
        task.status = "running"
        await task.save()

        # running -> completed
        task.status = "completed"
        task.completed_at = datetime.utcnow()
        await task.save()

        await task.sync()
        assert task.status == "completed"
        assert task.completed_at is not None

        await task.delete()

    @pytest.mark.asyncio
    async def test_task_relationships(self, test_user, test_session, test_message):
        """Should have correct relationships"""
        task = ChatTask(
            session_id=test_session.id,
            message_id=test_message.id,
            user_id=test_user.id,
            status="pending",
        )
        await task.insert()

        # Verify foreign keys are set correctly
        assert task.session_id == test_session.id
        assert task.message_id == test_message.id
        assert task.user_id == test_user.id

        await task.delete()


class TestMessageStatus:
    """Test Message status field"""

    @pytest.mark.asyncio
    async def test_message_status_field(self, test_session):
        """Should support all message statuses"""
        statuses = ["pending", "streaming", "completed", "error", "cancelled"]

        messages = []
        for status in statuses:
            message = Message(
                session_id=test_session.id,
                role="assistant",
                content={"type": "text", "text": "test"},
                status=status,
            )
            await message.insert()
            messages.append(message)

        # Verify all statuses are saved correctly
        saved_messages = await Message.find(
            Message.session_id == test_session.id
        ).to_list()

        saved_statuses = [m.status for m in saved_messages]
        for status in statuses:
            assert status in saved_statuses

        # Cleanup
        for msg in messages:
            await msg.delete()