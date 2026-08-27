import React from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck } from "lucide-react";

const DigitalAffinityPage: React.FC = () => {
  const { profile } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Digital & Affinity
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile?.full_name}
          </p>
        </div>

        <Card className="border-dashed border-slate-300">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarCheck className="h-6 w-6" />
            </div>

            <h2 className="text-base font-bold text-slate-900">
              Dashboard Digital & Affinity belum dikonfigurasi
            </h2>

            <p className="mt-2 max-w-lg text-sm text-slate-500">
              Untuk sementara, aktivitas harian, pekerjaan project,
              follow-up, dan koordinasi dicatat melalui modul Aktivitas.
            </p>

            <Button asChild className="mt-5">
              <Link to="/aktivitas">
                Buka Aktivitas
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DigitalAffinityPage;
