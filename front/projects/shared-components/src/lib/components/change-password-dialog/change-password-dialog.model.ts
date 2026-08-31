import { ChangePasswordRequestDto } from "@mon3/sa";

export interface ChangePasswordDialogData {
  username?: string;
  resetAvailable: boolean;
  showOldPassword: boolean;
}

export type ChangePasswordDialogResult = 
  | { action: 'set'; data: ChangePasswordRequestDto }
  | { action: 'reset' }
  | { action: 'cancel' };