import json
import torch

a_state = torch.load("results/lewis_signaling/models/agent_a_warmup.pt", map_location="cpu", weights_only=True)
b_state = torch.load("results/lewis_signaling/models/agent_b_warmup.pt", map_location="cpu", weights_only=True)

weights = {
    "agent_a": {k: v.tolist() for k, v in a_state.items()},
    "agent_b": {k: v.tolist() for k, v in b_state.items()},
    "vocab_size": 4,
    "n_colors": 8,
    "n_shapes": 8,
    "n_objects": 64,
}

with open("results/lewis_signaling/models/weights.json", "w") as f:
    json.dump(weights, f)

print("Exported weights successfully to results/lewis_signaling/models/weights.json")
