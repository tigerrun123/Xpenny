export default async function Job({
  params,
}: {
  params: Promise<{ jobPda: string }>;
}) {
  const { jobPda } = await params;
  return (
    <section className="card">
      <h1>Job</h1>
      <p>
        PDA: <code>{jobPda}</code>
      </p>
      <p>
        Status, escrow, result hash, evaluation hash, and settlement data render
        here.
      </p>
      <button>Confirm financial action</button>
    </section>
  );
}
