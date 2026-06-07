import { CategoryHome } from "@/components/category-home";

export const metadata = { title: "Gym & Strength" };

export default function GymPage() {
  return <CategoryHome category="gym" libraryLabel="Exercises" />;
}
