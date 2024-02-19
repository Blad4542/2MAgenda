import Agenda from "@/components/Agenda";
import AuthButton from "../components/AuthButton";

export default async function Index() {
  const currentDate = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col h-screen w-full">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-4xl flex justify-between items-center p-3 text-sm">
          <AuthButton />
        </div>
      </nav>
      <div className="min-h-screen bg-gray-100 p-5">
        <div className="flex flex-col h-screen w-full overflow-y-auto">
          <div className="flex-1 w-full">Agenda - {currentDate}</div>
          <Agenda />
        </div>
      </div>
    </div>
  );
}
