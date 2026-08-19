// Тип для пункта меню
export interface MenuItem {
    label: string;
    route?: string;
    children?: MenuItem[];
}