import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.services.email_templates import feedback_email


def main() -> None:
    html = feedback_email(
        student_name="Ángel",
        deliverable_num=1,
        project_name="AI Agent for Auto-Grading",
        score=82,
        criteria_breakdown={
            "Research depth": 20,
            "Source quality": 16,
            "Motivation clarity": 25,
            "Writing structure": 21,
        },
        criteria_max_points={
            "Research depth": 25,
            "Source quality": 20,
            "Motivation clarity": 30,
            "Writing structure": 25,
        },
        feedback_text=(
            "Your submission shows a strong understanding of the academic problem and proposes a coherent "
            "AI-based solution. The motivation is clear and the structure is readable. To improve it further, "
            "you should include more specific sources, compare existing grading workflows, and explain the risks "
            "of automated evaluation in more depth."
        ),
        platform_url="http://localhost:5173",
    )

    output_path = BACKEND_ROOT / "docs" / "week3" / "feedback_email_preview.html"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")

    print(f"HTML preview created at: {output_path}")


if __name__ == "__main__":
    main()