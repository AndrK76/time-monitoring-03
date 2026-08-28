// Тип для пункта меню
export interface MenuItem {
    label: string;
    route?: string;
    exact?: boolean;
    hideOnLarge?: boolean;
    hideOnSmall?: boolean;
    children?: MenuItem[];
}