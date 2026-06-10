import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode
} from "react";

type AppUiContextValue = {
	selectedUserId: string;
	selectedListId: string | null;
	setSelectedListId: (listId: string | null) => void;
	setSelectedUserId: (userId: string) => void;
};

const AppUiContext = createContext<AppUiContextValue | undefined>(undefined);

export function AppUiProvider({ children }: { children: ReactNode }) {
	const [selectedUserId, setSelectedUserIdState] = useState("alice");
	const [selectedListId, setSelectedListId] = useState<string | null>(null);

	const setSelectedUserId = useCallback((userId: string) => {
		setSelectedUserIdState(userId);
		setSelectedListId(null);
	}, []);

	const value = useMemo(
		() => ({
			selectedUserId,
			selectedListId,
			setSelectedListId,
			setSelectedUserId
		}),
		[selectedListId, selectedUserId, setSelectedUserId]
	);

	return <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>;
}

export function useAppUi() {
	const context = useContext(AppUiContext);

	if (!context) {
		throw new Error("useAppUi must be used inside AppUiProvider.");
	}

	return context;
}

