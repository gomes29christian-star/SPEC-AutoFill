export interface FillItem {
  id: string;
  name: string;
  fill: string;
  createdAt: string; // Formato brasileiro dd/mm/aaaa
  updatedAt?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  createdAt: string; // Formato brasileiro dd/mm/aaaa
  fills: FillItem[];
}

export interface FieldSignature {
  tagName: string;
  type: string;
  strategy: string;
  id: string | null;
  name: string | null;
  formId: string | null;
  formName: string | null;
  labelText: string;
  placeholder: string | null;
  ariaLabel: string | null;
  dataTestId: string | null;
  autocomplete: string | null;
}

export interface BindingItem {
  id: string;
  folderId: string;
  origin: string;
  path: string;
  fieldSignature: FieldSignature;
  createdAt: string; // dd/mm/aaaa
}

export interface TestCaseResult {
  id: number;
  title: string;
  passed: boolean;
  duration: string;
  error: string | null;
}

export interface SecretAchievement {
  id: string;
  title: string;
  description: string;
  hint: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null; // dd/mm/aaaa
}
