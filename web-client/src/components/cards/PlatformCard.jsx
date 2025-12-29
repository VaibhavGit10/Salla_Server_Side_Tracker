import "./PlatformCard.css";

export default function PlatformCard({
  name,
  description,
  status,
  children
}) {
  return (
    <div className="platform-card">
      <div className="platform-header">
        <div>
          <h3>{name}</h3>
          <p>{description}</p>
        </div>
        <span className={`badge ${status}`}>
          {status === "connected" ? "Connected" : "Not Connected"}
        </span>
      </div>

      <div className="platform-body">{children}</div>
    </div>
  );
}
