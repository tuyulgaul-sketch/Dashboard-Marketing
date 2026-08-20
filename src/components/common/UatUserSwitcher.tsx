import React, { useState, useEffect } from 'react';
import { store, BASELINE_USERS } from '@/services/store';
import { User } from '@/types';
import { UserCheck, ChevronDown, ShieldAlert } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const UatUserSwitcher: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(store.getCurrentUser());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  const handleSelectUser = (userId: string) => {
    store.setCurrentUser(userId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-medium gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <div className="flex flex-col text-left text-xs">
            <span className="font-semibold leading-none">{currentUser.name}</span>
            <span className="text-[10px] text-emerald-700 leading-none mt-0.5">{currentUser.position}</span>
          </div>
          <Badge variant="secondary" className="bg-emerald-200 text-emerald-800 text-[10px] ml-1 px-1.5 py-0">
            {currentUser.role}
          </Badge>
          <ChevronDown className="w-3.5 h-3.5 text-emerald-600 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-h-[80vh] overflow-y-auto" align="end">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          UAT Account Switcher (27 Master Users)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {BASELINE_USERS.map((user) => {
            const isSelected = user.id === currentUser.id;
            return (
              <DropdownMenuItem
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className={`flex flex-col items-start py-2 cursor-pointer ${
                  isSelected ? 'bg-emerald-50 text-emerald-900 font-medium' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold">{user.name}</span>
                  <span className="text-[10px] text-gray-500">{user.role}</span>
                </div>
                <div className="flex items-center justify-between w-full mt-0.5 text-[11px] text-gray-500">
                  <span>{user.position}</span>
                  <span className="text-[10px] text-emerald-600 font-mono">{user.department !== 'None' ? user.department : user.unit}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};