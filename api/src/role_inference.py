# role_inference.py
import sys
from pgmpy.models import BayesianModel
from pgmpy.factors.discrete import TabularCPD
from pgmpy.inference import VariableElimination

# --- модель ---
model = BayesianModel([
    ("cognitive_load", "role"),
    ("team_performance", "role"),
    ("reliance", "role")
])

cpd_cognitive_load = TabularCPD("cognitive_load", 2, [[0.6], [0.4]],
                                state_names={"cognitive_load": ["low", "high"]})
cpd_team_performance = TabularCPD("team_performance", 2, [[0.5], [0.5]],
                                  state_names={"team_performance": ["low", "high"]})
cpd_reliance = TabularCPD("reliance", 2, [[0.7], [0.3]],
                          state_names={"reliance": ["low", "high"]})

cpd_role = TabularCPD(
    "role", 5,
    values=[
        [0.3, 0.1, 0.2, 0.1, 0.15, 0.05, 0.1, 0.05],
        [0.2, 0.3, 0.1, 0.2, 0.25, 0.4, 0.15, 0.3],
        [0.2, 0.3, 0.4, 0.3, 0.2, 0.3, 0.3, 0.2],
        [0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.25, 0.15],
        [0.2, 0.2, 0.2, 0.3, 0.2, 0.15, 0.2, 0.3]
    ],
    evidence=["cognitive_load", "team_performance", "reliance"],
    evidence_card=[2, 2, 2],
    state_names={
        "role": ["Facilitator", "Observer", "Analyst", "DevilAdvocate", "Recommender"],
        "cognitive_load": ["low", "high"],
        "team_performance": ["low", "high"],
        "reliance": ["low", "high"]
    }
)

model.add_cpds(cpd_cognitive_load, cpd_team_performance, cpd_reliance, cpd_role)
inference = VariableElimination(model)

def get_role(cl, tp, rl):
    result = inference.query(variables=["role"], evidence={
        "cognitive_load": cl,
        "team_performance": tp,
        "reliance": rl
    })
    idx = result.values.argmax()
    return result.state_names["role"][idx]

if __name__ == "__main__":
    cl, tp, rl = sys.argv[1], sys.argv[2], sys.argv[3]
    print(get_role(cl, tp, rl))
