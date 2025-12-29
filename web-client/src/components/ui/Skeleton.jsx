import "./Skeleton.css";

export default function Skeleton({ height = 16, width = "100%" }) {
  return (
    <div
      className="skeleton"
      style={{ height, width }}
      aria-busy="true"
    />
  );
}
