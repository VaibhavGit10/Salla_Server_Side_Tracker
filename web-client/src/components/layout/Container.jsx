export default function Container({ title, subtitle, children }) {
  return (
    <main style={{ padding: "32px", flex: 1 }}>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: "6px 0 0", color: "#9ca3af" }}>
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </main>
  );
}
