import { Skeleton } from "antd";

export default function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton.Input key={i} active block size="large" />
      ))}
    </div>
  );
}
