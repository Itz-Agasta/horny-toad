import torch
from train import train
from eval  import plot_training, plot_token_dist

if __name__ == "__main__":
    agent_a, agent_b, history, game = train(
        n_epochs=600, batch_size=256, vocab_size=8,
        msg_len=2, lr=1e-3, warmup_epochs=300,
        temp_start=2.0, temp_end=0.3,
    )
    torch.save(agent_a.state_dict(), "agent_a.pt")
    torch.save(agent_b.state_dict(), "agent_b.pt")
    plot_training(history)
    plot_token_dist(agent_a, game)

    best = max(history["acc"])
    print(f"\nBest accuracy : {best:.3f}")
    print(f"Random baseline: 0.0625")
    if best > 0.80:
        print("H1 CONFIRMED — agents learned to coordinate!")
    else:
        print("Not there yet — try n_epochs=1000, lr=3e-4")