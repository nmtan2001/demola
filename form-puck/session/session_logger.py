import json
import os
from datetime import datetime


class SessionLogger:
    def __init__(self, exercise_name, output_dir="session_logs"):
        self._exercise_name = exercise_name
        self._output_dir = output_dir
        self._start_time = datetime.now()
        self._reps = []
        os.makedirs(output_dir, exist_ok=True)

    def log_rep(self, rep_number, form_score, faults, angles):
        self._reps.append({
            "rep": rep_number,
            "form_score": form_score,
            "faults": [{"name": f["name"], "description": f["description"]}
                       for f in faults],
            "angles": {k: round(v, 1) for k, v in angles.items()
                       if isinstance(v, (int, float))},
            "timestamp": datetime.now().isoformat(),
        })

    def generate_report(self):
        """Generate session after-action report."""
        total_reps = len(self._reps)
        if total_reps == 0:
            return {
                "exercise": self._exercise_name,
                "start_time": self._start_time.isoformat(),
                "end_time": datetime.now().isoformat(),
                "total_reps": 0,
                "average_score": 0,
                "fault_counts": {},
                "reps": [],
            }

        scores = [r["form_score"] for r in self._reps]
        avg_score = sum(scores) / len(scores)

        fault_counts = {}
        for rep in self._reps:
            for fault in rep["faults"]:
                name = fault["name"]
                fault_counts[name] = fault_counts.get(name, 0) + 1

        most_common_fault = max(fault_counts, key=fault_counts.get) if fault_counts else None

        report = {
            "exercise": self._exercise_name,
            "start_time": self._start_time.isoformat(),
            "end_time": datetime.now().isoformat(),
            "total_reps": total_reps,
            "average_score": round(avg_score, 1),
            "best_rep": max(scores),
            "worst_rep": min(scores),
            "most_common_fault": most_common_fault,
            "fault_counts": fault_counts,
            "reps": self._reps,
        }

        # Save to file
        timestamp = self._start_time.strftime("%Y%m%d_%H%M%S")
        filename = f"{self._exercise_name}_{timestamp}.json"
        filepath = os.path.join(self._output_dir, filename)
        with open(filepath, "w") as f:
            json.dump(report, f, indent=2)

        return report

    def get_summary_text(self):
        """Get a one-line session summary for Bluetooth sync format."""
        total = len(self._reps)
        if total == 0:
            return f"{self._exercise_name}: 0 reps"
        scores = [r["form_score"] for r in self._reps]
        avg = sum(scores) / len(scores)
        return f"{self._exercise_name}: {total} reps, {avg:.0f}% form accuracy"
