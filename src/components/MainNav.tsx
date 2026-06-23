import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarCheck, ChevronDown, Target, Users } from "lucide-react";
import { useCompanyData } from "@/hooks/useCompanyData";

export function MainNav() {
  const navigate = useNavigate();
  const { tasks } = useCompanyData();
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Users className="h-4 w-4" />
            Vista SDR
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => navigate("/")}>Lista de prospección</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/tasks")}>
            Tareas SDR{pendingTasksCount > 0 ? ` (${pendingTasksCount})` : ""}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Target className="h-4 w-4" />
            Vista AE
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => navigate("/deals")}>Deals</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/ae-tasks")}>Tareas AE</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/meetings")}>
        <CalendarCheck className="h-4 w-4" />
        Dashboard
      </Button>
    </div>
  );
}