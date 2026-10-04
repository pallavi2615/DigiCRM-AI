from apscheduler.schedulers.background import BackgroundScheduler
from app.db.database import SessionLocal
from app.services.automation_service import AutomationEngine
import logging

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def run_time_rules():
    """Run all time-based automation rules."""
    db = SessionLocal()
    try:
        engine = AutomationEngine(db)
        engine.run_time_rules()
        logger.info("Time-based automations completed")
    except Exception as e:
        logger.error(f"Automation worker error: {e}")
    finally:
        db.close()


def start_automation_worker():
    scheduler.add_job(
        run_time_rules,
        "interval",
        hours=6,
        id="automation_time_rules",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Automation worker started")


def stop_automation_worker():
    scheduler.shutdown()