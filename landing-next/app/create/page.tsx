import { CourseForm } from "@/components/course";

export const metadata = {
  title: "יצירת קורס | CourseFlow",
  description: "צור קורס חדש עם דף נחיתה מותאם אישית",
};

export default function CreateCoursePage() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CourseForm />
    </main>
  );
}
