import { CategoryHome } from "@/components/category-home";

export const metadata = { title: "Flexibility & Mobility" };

export default function FlexibilityPage() {
  return (
    <CategoryHome
      category="flexibility"
      libraryLabel="Stretches"
      startMode="guide"
    />
  );
}
