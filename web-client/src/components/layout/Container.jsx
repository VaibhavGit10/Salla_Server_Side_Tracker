export default function Container({ title, subtitle, children }) {
  return (
    <main className="container">
      <header className="containerHeader">
        <div className="containerTitleWrap">
          <h1 className="containerTitle">{title}</h1>
          {subtitle ? <p className="containerSubtitle">{subtitle}</p> : null}
        </div>
      </header>

      <section className="containerBody">{children}</section>
    </main>
  );
}
