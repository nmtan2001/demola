export const EXERCISE_CONFIGS = [
{
    "name": "Squat",
    "landmarks": {
        "left_shoulder": 11,
        "right_shoulder": 12,
        "left_hip": 23,
        "right_hip": 24,
        "left_knee": 25,
        "right_knee": 26,
        "left_ankle": 27,
        "right_ankle": 28,
        "left_foot_index": 31,
        "right_foot_index": 32
    },
    "angles": {
        "knee": {
            "points": ["left_hip", "left_knee", "left_ankle"],
            "points_secondary": ["right_hip", "right_knee", "right_ankle"],
            "ideal_min": 70,
            "ideal_max": 100,
            "fault_min": 110
        },
        "hip": {
            "points": ["left_shoulder", "left_hip", "left_knee"],
            "points_secondary": ["right_shoulder", "right_hip", "right_knee"],
            "ideal_min": 45,
            "ideal_max": 90
        },
        "back": {
            "points": ["left_shoulder", "left_hip"],
            "vertical_threshold": 45
        }
    },
    "rep_detection": {
        "state_machine": "descending_ascending",
        "stand_min": 160,
        "descent_start": 145,
        "bottom_target": 90,
        "peak_hold_frames": 3,
        "min_rep_frames": 20
    },
    "scoring": {
        "base_score": 100,
        "faults": {
            "back_rounding": {
                "deduction": 20,
                "threshold_deg": 45,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK", "RETURN"],
                "description": "Back rounding - excessive forward lean"
            },
            "insufficient_depth": {
                "deduction": 15,
                "threshold_deg": 110,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Insufficient depth - go deeper"
            },
            "knee_cave": {
                "deduction": 15,
                "threshold_deg": 15,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Knee cave detected - push knees out"
            },
            "asymmetric_descent": {
                "deduction": 10,
                "threshold_deg": 10,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Asymmetric descent - even out both sides"
            },
            "bounce_at_bottom": {
                "deduction": 10,
                "velocity_threshold": 0.3,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Bouncing at bottom - control the movement"
            }
        }
    }
},
{
    "name": "Bicep Curl",
    "landmarks": {
        "left_shoulder": 11,
        "right_shoulder": 12,
        "left_elbow": 13,
        "right_elbow": 14,
        "left_wrist": 15,
        "right_wrist": 16,
        "left_hip": 23,
        "right_hip": 24
    },
    "angles": {
        "elbow": {
            "points": ["left_shoulder", "left_elbow", "left_wrist"],
            "points_secondary": ["right_shoulder", "right_elbow", "right_wrist"],
            "use_2d_only": true,
            "ideal_min": 30,
            "ideal_max": 45
        },
        "shoulder": {
            "points": ["left_hip", "left_shoulder", "left_elbow"],
            "points_secondary": ["right_hip", "right_shoulder", "right_elbow"],
            "use_2d_only": true,
            "ideal_min": 0,
            "ideal_max": 30
        }
    },
    "rep_detection": {
        "state_machine": "contracting_extending",
        "use_2d_only": true,
        "extended_threshold": 145,
        "contracted_threshold": 65,
        "transition_buffer": 10,
        "hold_frames": 3,
        "standing_stability_frames": 5,
        "min_rep_frames": 10
    },
    "scoring": {
        "base_score": 100,
        "faults": {
            "elbow_swing": {
                "deduction": 25,
                "threshold_deg": 35,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Elbow swinging - keep elbow tucked"
            },
            "insufficient_contraction": {
                "deduction": 20,
                "threshold_deg": 70,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Not curling all the way up - full range of motion"
            }
        }
    }
},
{
    "name": "Deadlift",
    "landmarks": {
        "left_shoulder": 11,
        "right_shoulder": 12,
        "left_hip": 23,
        "right_hip": 24,
        "left_knee": 25,
        "right_knee": 26,
        "left_ankle": 27,
        "right_ankle": 28,
        "left_wrist": 15,
        "right_wrist": 16
    },
    "angles": {
        "knee": {
            "points": ["left_hip", "left_knee", "left_ankle"],
            "points_secondary": ["right_hip", "right_knee", "right_ankle"],
            "ideal_min": 140,
            "ideal_max": 180
        },
        "hip": {
            "points": ["left_shoulder", "left_hip", "left_knee"],
            "points_secondary": ["right_shoulder", "right_hip", "right_knee"],
            "ideal_min": 60,
            "ideal_max": 120
        },
        "back": {
            "points": ["left_shoulder", "left_hip"],
            "vertical_threshold": 30
        }
    },
    "rep_detection": {
        "state_machine": "descending_ascending",
        "angle_points": ["left_shoulder", "left_hip", "left_knee"],
        "angle_points_secondary": ["right_shoulder", "right_hip", "right_knee"],
        "stand_min": 165,
        "descent_start": 145,
        "bottom_target": 95,
        "peak_hold_frames": 3,
        "min_rep_frames": 24
    },
    "scoring": {
        "base_score": 100,
        "faults": {
            "back_rounding": {
                "deduction": 25,
                "threshold_deg": 60,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK", "RETURN"],
                "description": "Torso forward lean - keep chest up"
            },
            "bar_path_deviation": {
                "deduction": 15,
                "threshold_cm": 15,
                "clear_margin_cm": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Bar drifting from legs"
            },
            "hip_shoot": {
                "deduction": 20,
                "threshold_deg": 15,
                "clear_margin_deg": 5,
                "active_during": ["RETURN"],
                "description": "Hips rising before chest - drive chest up"
            }
        }
    }
},
{
    "name": "Lunge",
    "landmarks": {
        "left_shoulder": 11,
        "right_shoulder": 12,
        "left_hip": 23,
        "right_hip": 24,
        "left_knee": 25,
        "right_knee": 26,
        "left_ankle": 27,
        "right_ankle": 28,
        "left_foot_index": 31,
        "right_foot_index": 32
    },
    "angles": {
        "knee": {
            "points": ["left_hip", "left_knee", "left_ankle"],
            "points_secondary": ["right_hip", "right_knee", "right_ankle"],
            "ideal_min": 70,
            "ideal_max": 100
        },
        "hip": {
            "points": ["left_shoulder", "left_hip", "left_knee"],
            "points_secondary": ["right_shoulder", "right_hip", "right_knee"],
            "ideal_min": 45,
            "ideal_max": 90
        },
        "back": {
            "points": ["left_shoulder", "left_hip"],
            "vertical_threshold": 45
        }
    },
    "rep_detection": {
        "state_machine": "descending_ascending",
        "stand_min": 165,
        "descent_start": 145,
        "bottom_target": 90,
        "peak_hold_frames": 3,
        "min_rep_frames": 20
    },
    "scoring": {
        "base_score": 100,
        "faults": {
            "knee_over_toe": {
                "deduction": 20,
                "threshold_cm": 0,
                "clear_margin_cm": 3,
                "direction": "above",
                "knee_angle_mode": "max",
                "active_during": ["PEAK"],
                "description": "Knee too far forward"
            },
            "insufficient_depth": {
                "deduction": 15,
                "threshold_deg": 110,
                "clear_margin_deg": 5,
                "knee_angle_mode": "max",
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Not deep enough - lower your hips"
            },
            "back_rounding": {
                "deduction": 20,
                "threshold_deg": 35,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK", "RETURN"],
                "description": "Leaning too far forward"
            },
            "asymmetric_descent": {
                "deduction": 10,
                "threshold_deg": 15,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Uneven descent - stay balanced"
            }
        }
    }
},
{
    "name": "Overhead Press",
    "landmarks": {
        "left_shoulder": 11,
        "right_shoulder": 12,
        "left_elbow": 13,
        "right_elbow": 14,
        "left_wrist": 15,
        "right_wrist": 16,
        "left_hip": 23,
        "right_hip": 24
    },
    "angles": {
        "elbow": {
            "points": ["left_shoulder", "left_elbow", "left_wrist"],
            "points_secondary": ["right_shoulder", "right_elbow", "right_wrist"],
            "ideal_min": 160,
            "ideal_max": 180
        },
        "shoulder": {
            "points": ["left_hip", "left_shoulder", "left_elbow"],
            "points_secondary": ["right_hip", "right_shoulder", "right_elbow"],
            "ideal_min": 0,
            "ideal_max": 30
        },
        "back": {
            "points": ["left_shoulder", "left_hip"],
            "vertical_threshold": 45
        }
    },
    "rep_detection": {
        "state_machine": "descending_ascending",
        "direction": "increase",
        "angle_points": ["left_shoulder", "left_elbow", "left_wrist"],
        "angle_points_secondary": ["right_shoulder", "right_elbow", "right_wrist"],
        "stand_min": 150,
        "descent_start": 130,
        "bottom_target": 100,
        "peak_hold_frames": 3,
        "min_rep_frames": 20
    },
    "scoring": {
        "base_score": 100,
        "faults": {
            "incomplete_lockout": {
                "deduction": 20,
                "threshold_deg": 155,
                "clear_margin_deg": 5,
                "direction": "below",
                "active_during": ["PEAK"],
                "description": "Not fully locked out - extend arms"
            },
            "arching_back": {
                "deduction": 25,
                "threshold_deg": 20,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK", "RETURN"],
                "description": "Arching back - keep core tight"
            },
            "elbow_flare": {
                "deduction": 15,
                "threshold_deg": 45,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Elbows flaring - tuck them in"
            }
        }
    }
},
{
    "name": "Push-up",
    "landmarks": {
        "left_shoulder": 11,
        "right_shoulder": 12,
        "left_elbow": 13,
        "right_elbow": 14,
        "left_wrist": 15,
        "right_wrist": 16,
        "left_hip": 23,
        "right_hip": 24,
        "left_knee": 25,
        "right_knee": 26,
        "left_ankle": 27,
        "right_ankle": 28
    },
    "angles": {
        "elbow": {
            "points": ["left_shoulder", "left_elbow", "left_wrist"],
            "points_secondary": ["right_shoulder", "right_elbow", "right_wrist"],
            "ideal_min": 70,
            "ideal_max": 100
        },
        "hip": {
            "points": ["left_shoulder", "left_hip", "left_ankle"],
            "points_secondary": ["right_shoulder", "right_hip", "right_ankle"],
            "ideal_min": 160,
            "ideal_max": 195
        },
        "back": {
            "points": ["left_shoulder", "left_hip"],
            "vertical_threshold": 45
        }
    },
    "rep_detection": {
        "state_machine": "descending_ascending",
        "angle_points": ["left_shoulder", "left_elbow", "left_wrist"],
        "angle_points_secondary": ["right_shoulder", "right_elbow", "right_wrist"],
        "stand_min": 160,
        "descent_start": 140,
        "bottom_target": 90,
        "peak_hold_frames": 3,
        "min_rep_frames": 20
    },
    "scoring": {
        "base_score": 100,
        "faults": {
            "sagging_hips": {
                "deduction": 20,
                "threshold_cm": 4,
                "clear_margin_cm": 2,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Hips sagging - keep body straight"
            },
            "half_rep": {
                "deduction": 20,
                "threshold_deg": 100,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Half rep - go lower"
            },
            "asymmetric_descent": {
                "deduction": 10,
                "threshold_deg": 15,
                "clear_margin_deg": 5,
                "active_during": ["ACTIVE", "PEAK"],
                "description": "Uneven descent - keep both arms even"
            }
        }
    }
}
];
