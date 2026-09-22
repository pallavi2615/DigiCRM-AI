from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import date
import logging

from app.db.database import SessionLocal
from app.models.Followup import FollowupTask

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def process_due_tasks():
    """Mark overdue tasks as in_progress."""
    db: Session = SessionLocal()
    try:
        today = date.today()
        tasks = (
            db.query(FollowupTask)
            .filter(FollowupTask.status == "pending")
            .filter(FollowupTask.due_date <= today)
            .all()
        )

        for task in tasks:
            task.status = "in_progress"
            logger.info(f"Task {task.id} due: {task.title}")

        if tasks:
            db.commit()
            logger.info(f"Processed {len(tasks)} due tasks")
    except Exception as e:
        logger.error(f"Worker error: {e}")
    finally:
        db.close()


def start_worker():
    scheduler.add_job(
        process_due_tasks,
        "interval",
        minutes=5,
        id="process_followup_tasks",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Follow-up worker started")


def stop_worker():
    scheduler.shutdown()
    logger.info("Follow-up worker stopped")