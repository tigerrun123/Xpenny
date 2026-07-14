export default function CreateJob() {
  return (
    <section className="card">
      <h1>Create Job</h1>
      <p>
        Review amount, mint, worker, evaluator, deadline, and instruction
        summary before signing.
      </p>
      <input placeholder="Job ID" />
      <textarea placeholder="Canonical task specification JSON" />
      <input placeholder="Worker Agent PDA" />
      <input placeholder="Evaluator Agent PDA" />
      <input placeholder="Payment mint" />
      <input placeholder="Amount base units" />
      <button>Simulate and build unsigned transaction</button>
    </section>
  );
}
