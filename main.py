import os
import torch

from lewis_signaling.eval import (
    plot_training,
    plot_token_dist,
    plot_ablation,
    pmi_analysis,
)
from lewis_signaling.train import train

PLOTS_DIR = "results/lewis_signaling"
MODELS_DIR = "results/lewis_signaling/models"
os.makedirs(MODELS_DIR, exist_ok=True)


CONFIG = dict(
    n_epochs=600,
    batch_size=256,
    n_colors=8,
    n_shapes=8,
    vocab_size=4,
    msg_len=1,
    hidden=64,
    lr=1e-3,
    temp_start=2.0,
    temp_end=0.3,
)
BASELINE = 1 / 64  # 1.56%

if __name__ == "__main__":
    # Exp 1: warm-up
    print("=" * 60)
    print("  EXP 1/2 — Warm-up  (bottlenecked SFT → distillation)")
    print(
        f"  Task: {CONFIG['n_colors']}×{CONFIG['n_shapes']} objects | "
        f"vocab={CONFIG['vocab_size']} | msg_len={CONFIG['msg_len']}"
    )
    print("=" * 60)

    a_wu, b_wu, h_wu, game = train(**CONFIG, warmup_epochs=300)

    torch.save(a_wu.state_dict(), f"{MODELS_DIR}/agent_a_warmup.pt")
    torch.save(b_wu.state_dict(), f"{MODELS_DIR}/agent_b_warmup.pt")
    plot_training(h_wu,  save_path=f"{PLOTS_DIR}/training_warmup.png", baseline=BASELINE)
    plot_token_dist(a_wu, game, save_path=f"{PLOTS_DIR}/tokens_warmup.png")
    pmi_analysis(a_wu, game)

    # Exp 2: cold-start
    print("=" * 60)
    print("  EXP 2/2 — Cold-start  (no hint, Gumbel-Softmax only)")
    print("=" * 60)

    a_cs, b_cs, h_cs, _ = train(**CONFIG, warmup_epochs=0)

    plot_ablation(h_wu, h_cs, baseline=BASELINE, save_path=f"{PLOTS_DIR}/ablation.png")

    # summery
    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    print(f"  Warm-up best    : {max(h_wu['acc']):.3f}")
    print(f"  Cold-start best : {max(h_cs['acc']):.3f}")
    print(f"  Gap (H2)        : {max(h_wu['acc']) - max(h_cs['acc']):+.3f}")
    print(f"  Random baseline : {BASELINE:.4f}")
    print(f"  Improvement     : {max(h_wu['acc']) / BASELINE:.1f}× over random")
    print("=" * 60)