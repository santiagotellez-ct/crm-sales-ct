import { useNavigate } from "react-router-dom";
import { MainNav } from "@/components/MainNav";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Users, ChevronDown, Settings } from "lucide-react";

export function GlobalHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="sticky top-0 z-50 border-b-2 border-foreground bg-background/95 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-display font-extrabold text-sm">
            CT
          </div>
          <div className="font-display font-extrabold tracking-tight text-foreground text-base uppercase">
            Colombia Tech · Sales OS
          </div>
        </div>

        <div className="flex items-center gap-4">
          <MainNav />
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs uppercase">
                    {(profile.full_name || profile.email).charAt(0)}
                  </div>
                  <span className="hidden sm:block max-w-[140px] truncate">
                    {profile.full_name || profile.email}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate("/settings/team")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar equipo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium leading-none">{profile.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {profile.role === "admin" ? "Administrador" : "Usuario"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                {profile.role === "admin" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/admin/users")}>
                      <Users className="h-4 w-4 mr-2" />
                      Gestión de usuarios
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
