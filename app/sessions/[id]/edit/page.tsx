import { SessionEditor } from "@/components/session/session-editor";

export const metadata = { title: "Edit session" };

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionEditor id={id} />;
}
