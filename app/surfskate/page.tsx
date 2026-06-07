import { CategoryHome } from "@/components/category-home";

export const metadata = { title: "Surfskate" };

export default function SurfskatePage() {
  return (
    <CategoryHome category="surfskate" libraryLabel="Drills" startMode="guide" />
  );
}
