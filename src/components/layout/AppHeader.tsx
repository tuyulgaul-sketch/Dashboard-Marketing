import React, { useState, useEffect } from 'react';
import { store } from '@/services/store';
import { AppNotification, User } from '@/types';
import { Bell, ShieldCheck, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

export const AppHeader: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(store.getCurrentUser());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const updateData = () => {
      const u = store.getCurrentUser();
      setCurrentUser(u);
      setNotifications(store.getNotifications(u.id));
    };
    updateData();
    return store.subscribe(updateData);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (notif: AppNotification) => {
    store.markNotificationAsRead(notif.id);
    if (notif.linkPath) {
      navigate(notif.linkPath);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white font-black text-lg shadow-md">
          P
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900 leading-none">PT PERTA LIFE INSURANCE</h1>
          <p className="text-[11px] text-gray-500 font-medium leading-none mt-1">Dashboard Marketing Operating System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <span className="text-xs font-bold text-gray-700">Notifikasi System</span>
              <Badge variant="outline" className="text-[10px]">{unreadCount} belum dibaca</Badge>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">Belum ada notifikasi.</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 cursor-pointer text-xs hover:bg-blue-50 transition-colors ${
                      !n.isRead ? 'bg-blue-50/50 font-medium' : 'text-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-800">
                      <span>{n.title}</span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">{n.message}</p>
                    <span className="text-[9px] text-gray-400 mt-1 block">{new Date(n.createdAt).toLocaleTimeString('id-ID')}</span>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* UAT Switcher */}
      </div>
    </header>
  );
};
