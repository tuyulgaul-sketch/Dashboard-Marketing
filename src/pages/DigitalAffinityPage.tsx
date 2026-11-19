import React from "react";
import { Link } from "react-router-dom";
import { Activity, ClipboardCheck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFeature } from "@/lib/accessControl";

const DigitalAffinityPage: React.FC = () => {
  const { profile } = useAuth();
  const canSeeSurvey = canAccessFeature(profile, "SURVEY_PERTALIFE_CARE");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Digital & Affinity
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Workspace operasional Digital & Affinity.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {canSeeSurvey && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-5 w-5 text-blue-700" />
                  Survey PertaLife Care
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm leading-6 text-slate-600">
                  Monitor hasil survey, issue aplikasi, evidence, dan tindak lanjut
                  yang terhubung ke Activities.
                </p>
                <Button asChild>
                  <Link to="/survey-pertalife-care">Buka Survey Dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-slate-700" />
                Aktivitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                Kelola task pribadi, assignment, kolaborasi, dan tindak lanjut.
              </p>
              <Button asChild variant="outline">
                <Link to="/aktivitas">Buka Aktivitas</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default DigitalAffinityPage;
