import os

import matplotlib.pyplot as plt
import numpy as np
import torch

from .agents import AgentA
from .env import LewisGame


def _save(fig: plt.Figure, path: str) -> None:
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  saved → {path}")


def plot_training(
    history: dict,
    save_path: str = "results/lewis_signaling/training.png",
    baseline: float | None = None,
) -> None:
    b = baseline if baseline is not None else 0.0625
    epochs = history["epoch"]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

    # accuracy
    ax1.plot(epochs, history["acc"], linewidth=2.5, label="Accuracy")
    ax1.axhline(b, color="red", linestyle="--", label=f"Random ({b:.4f})")
    ax1.axhline(0.90, color="steelblue", linestyle="--", label="Target 90%")

    warmup_end = next(
        (e for e, p in zip(epochs, history["phase"]) if p == "finetune"), None
    )
    if warmup_end:
        ax1.axvline(
            warmup_end, color="orange", linestyle=":", linewidth=2, label="Hint removed"
        )

    ax1.set_title("H1: Accuracy over training")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Accuracy")
    ax1.set_ylim(0, 1.05)
    ax1.legend(fontsize=9)

    # loss
    ax2.plot(epochs, history["loss"], color="salmon", linewidth=2.5)
    ax2.set_title("Training loss")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Cross-entropy")

    fig.tight_layout()
    _save(fig, save_path)


def plot_token_dist(
    agent_a: AgentA,
    game: LewisGame,
    n_samples: int = 4000,
    save_path: str = "results/lewis_signaling/token_dist.png",
) -> None:
    _, colors, _ = game.sample(n_samples)

    with torch.no_grad():
        msg, _ = agent_a(colors, hint=None, temperature=0.1, hard=True)

    token_ids = msg.argmax(dim=-1).view(-1)
    counts = torch.bincount(token_ids, minlength=agent_a.vocab_size).numpy()
    sorted_c = np.sort(counts)[::-1]
    ranks = np.arange(1, len(sorted_c) + 1)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

    ax1.bar(range(len(sorted_c)), sorted_c, color="steelblue")
    ax1.set_title("H3: Token frequency by rank")
    ax1.set_xlabel("Token rank")
    ax1.set_ylabel("Count")

    mask = sorted_c > 0
    ax2.loglog(ranks[mask], sorted_c[mask], "o-", linewidth=2, color="darkorange")
    ax2.set_title("H3: Log-log plot  (Zipf ≈ straight line)")
    ax2.set_xlabel("Rank (log)")
    ax2.set_ylabel("Frequency (log)")

    fig.tight_layout()
    _save(fig, save_path)


def plot_ablation(
    history_warmup: dict,
    history_cold: dict,
    baseline: float | None = None,
    save_path: str = "results/lewis_signaling/ablation.png",
) -> None:
    b = baseline if baseline is not None else 1 / 64

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(
        history_warmup["epoch"],
        history_warmup["acc"],
        linewidth=2.5,
        label="Warm-up  (bottlenecked SFT → distillation)",
    )
    ax.plot(
        history_cold["epoch"],
        history_cold["acc"],
        linewidth=2.5,
        label="Cold-start  (no hint)",
    )
    ax.axhline(b, color="red", linestyle="--", label=f"Random ({b:.4f})")

    best_w = max(history_warmup["acc"])
    best_c = max(history_cold["acc"])
    ax.annotate(
        f"WU best: {best_w:.3f}",
        xy=(history_warmup["epoch"][-1], best_w),
        xytext=(-60, 10),
        textcoords="offset points",
        fontsize=9,
    )
    ax.annotate(
        f"CS best: {best_c:.3f}",
        xy=(history_cold["epoch"][-1], best_c),
        xytext=(-60, -18),
        textcoords="offset points",
        fontsize=9,
    )

    ax.set_title("H2 Ablation: Warm-up vs Cold-start")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Accuracy")
    ax.set_ylim(0, 1.05)
    ax.legend()

    fig.tight_layout()
    _save(fig, save_path)


def pmi_analysis(
    agent_a: AgentA,
    game: LewisGame,
    n_samples: int = 4000,
) -> None:
    _, colors, _ = game.sample(n_samples)

    with torch.no_grad():
        msg, _ = agent_a(colors, hint=None, temperature=0.1, hard=True)

    tok0 = msg[:, 0].argmax(dim=-1)  # first token position only

    print("\nColor → Token grounding (H3):")
    print(f"  {'color':>6}  {'dominant token':>15}  {'consistency':>12}  bar")
    print("  " + "─" * 55)

    for color in range(game.n_colors):
        mask = colors == color
        if mask.sum() == 0:
            continue
        counts = torch.bincount(tok0[mask], minlength=agent_a.vocab_size)
        dominant = counts.argmax().item()
        pct = counts[dominant].item() / mask.sum().item()
        bar = "█" * int(pct * 25)
        verdict = "✅" if pct >= 0.80 else "⚠️ "
        print(f"  {color:>6}  {f'token {dominant}':>15}  {pct:>11.0%}  {bar} {verdict}")

    print()
