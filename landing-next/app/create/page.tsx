import { CourseForm } from "@/components/course";

export const metadata = {
  title: "יצירת קורס | CourseFlow",
  description: "צור קורס חדש עם דף נחיתה מותאם אישית",
};

export default function CreateCoursePage() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10 max-w-4xl mx-auto">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-gray-900 text-lg font-bold">יצירת קורס חדש</p>
              <p className="text-gray-500 text-sm">שלב 1 מתוך 2: מידע בסיסי</p>
            </div>
            <span className="text-primary text-sm font-bold">50%</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "50%" }} />
          </div>
        </div>
      </div>

      <CourseForm />
    </main>
  );
}

