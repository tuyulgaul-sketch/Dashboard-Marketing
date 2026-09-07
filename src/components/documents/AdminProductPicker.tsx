import React, { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { filterAdminProductOptions } from '@/lib/adminProductSearch';
import { Check, ChevronsUpDown } from 'lucide-react';

interface Props {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  labelId?: string;
}

/** Local name search only. The parent retains the product/category and download gates. */
export const AdminProductPicker: React.FC<Props> = ({ value, options, onChange, disabled = false, labelId }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listId = useId();
  const filteredOptions = useMemo(() => filterAdminProductOptions(options, query), [options, query]);

  const selectProduct = (product: string) => {
    if (disabled) return;
    onChange(product);
    setQuery('');
    setOpen(false);
  };

  return (
    <Popover open={open && !disabled} onOpenChange={nextOpen => {
      if (disabled) return;
      setOpen(nextOpen);
      if (!nextOpen) setQuery('');
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open && !disabled}
          aria-controls={listId} aria-labelledby={labelId} disabled={disabled}
          className="w-full justify-between gap-2 text-left text-xs font-normal sm:max-w-md">
          <span className="min-w-0 truncate">{value === 'ALL' ? 'Semua Produk' : value}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[120] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}>
          <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Cari nama produk..."
            aria-label="Cari nama produk" className="text-sm" />
          <CommandList id={listId} className="max-h-72">
            <CommandGroup>
              <CommandItem value="ALL" onSelect={() => selectProduct('ALL')}>
                <Check className={`mr-2 h-4 w-4 ${value === 'ALL' ? 'opacity-100' : 'opacity-0'}`} />
                Semua Produk
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Produk">
              {filteredOptions.map(productName => (
                <CommandItem key={productName} value={productName} onSelect={() => selectProduct(productName)}>
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${value === productName ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="min-w-0 break-words">{productName}</span>
                </CommandItem>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada produk yang sesuai pencarian.</div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AdminProductPicker;
