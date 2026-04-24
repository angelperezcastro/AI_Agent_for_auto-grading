import logging

logger = logging.getLogger(__name__)


async def trigger_ai_evaluation(submission_id: int) -> None:
    """
    Week 2 placeholder.

    The real Gemini evaluation agent will be implemented in Week 3.
    For now, this function exists so the submission endpoint already has
    the correct asynchronous trigger structure.
    """
    logger.info(
        "AI evaluation placeholder triggered for submission_id=%s",
        submission_id,
    )