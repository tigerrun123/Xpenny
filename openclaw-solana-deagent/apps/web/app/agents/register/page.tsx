export default function Register() {
  return (
    <section className="card">
      <h1>Register Agent</h1>
      <p>
        Connect a wallet, review metadata hash, then sign the unsigned
        register-agent transaction.
      </p>
      <input placeholder="Agent ID" />
      <input placeholder="Agent card hash" />
      <input placeholder="Metadata URI" />
      <button>Build unsigned transaction</button>
    </section>
  );
}
