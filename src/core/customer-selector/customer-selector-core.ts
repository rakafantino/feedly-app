// Customer Selector Core
// Pure functions for customer selection

export interface CustomerSelectorState {
    searchTerm: string;
    selectedCustomerId?: string;
    isOpen: boolean;
}

export function createInitialState(): CustomerSelectorState {
    return { searchTerm: '', isOpen: false };
}

export function setSearchTerm(current: CustomerSelectorState, term: string): CustomerSelectorState {
    return { ...current, searchTerm: term };
}

export function setSelectedCustomer(current: CustomerSelectorState, id?: string): CustomerSelectorState {
    return { ...current, selectedCustomerId: id };
}

export function setOpen(current: CustomerSelectorState, isOpen: boolean): CustomerSelectorState {
    return { ...current, isOpen };
}

export function toggleOpen(current: CustomerSelectorState): CustomerSelectorState {
    return { ...current, isOpen: !current.isOpen };
}

export function resetState(): CustomerSelectorState {
    return createInitialState();
}

export function formatCustomerLabel(name: string, phone?: string | null): string {
    if (phone) return `${name} (${phone})`;
    return name;
}

export function isCustomerSelected(state: CustomerSelectorState, customerId: string): boolean {
    return state.selectedCustomerId === customerId;
}
