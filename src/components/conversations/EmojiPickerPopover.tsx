import { memo, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmojiPicker, { Theme, EmojiClickData, Categories } from "emoji-picker-react";
import { useTheme } from "next-themes";

interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

// Tradução das categorias para português
const categoriesTranslation = [
  { category: Categories.SUGGESTED, name: 'Usados recentemente' },
  { category: Categories.SMILEYS_PEOPLE, name: 'Sorrisos e pessoas' },
  { category: Categories.ANIMALS_NATURE, name: 'Animais e natureza' },
  { category: Categories.FOOD_DRINK, name: 'Comida e bebida' },
  { category: Categories.TRAVEL_PLACES, name: 'Viagens e lugares' },
  { category: Categories.ACTIVITIES, name: 'Atividades' },
  { category: Categories.OBJECTS, name: 'Objetos' },
  { category: Categories.SYMBOLS, name: 'Símbolos' },
  { category: Categories.FLAGS, name: 'Bandeiras' },
];

export const EmojiPickerPopover = memo(function EmojiPickerPopover({
  onEmojiSelect,
  disabled = false,
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          disabled={disabled}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 border-0 bg-transparent shadow-none emoji-picker-container" 
        side="top" 
        align="start"
        sideOffset={8}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
          width={320}
          height={380}
          searchPlaceHolder="Buscar emoji..."
          previewConfig={{ showPreview: false }}
          skinTonesDisabled
          lazyLoadEmojis
          categories={categoriesTranslation}
        />
      </PopoverContent>
    </Popover>
  );
});
