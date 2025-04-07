import { RefObject, createContext, useContext, useRef, useState } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
  sideBarRef: RefObject<HTMLDivElement | null>;
}

export const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggleSidebar: () => {},
  sideBarRef: { current: null } as RefObject<HTMLDivElement | null>,
});

export const useSidebar = () => {
  return useContext(SidebarContext);
};

export const SidebarProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const sideBarRef = useRef<HTMLDivElement>(null);

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar, sideBarRef }}>
      {children}
    </SidebarContext.Provider>
  );
};
