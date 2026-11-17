import { STATIONS } from "@/lib/domain";
import ScanPage from "./ScanPage";

export function generateStaticParams() {
  return STATIONS.map((s) => ({ code: s.code }));
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ScanPage code={code} />;
}
