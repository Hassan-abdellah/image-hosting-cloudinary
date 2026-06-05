export interface imagesTypes {
  createdAt: Date;
  size: number;
  id: string;
  user_id: string;
  file_name: string;
  original_name: string;
  folder_id: string;
  folder?: {
    path?: string;
  };
}

export interface ClerkUserData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string;
  image_url: string;
  email_addresses: {
    id: string;
    email_address: string;
    verification: { status: "verified" | "unverified"; strategy: string };
  }[];
  primary_email_address_id: string | null;
  external_accounts: {
    provider: string;
    email_address: string;
    avatar_url: string;
  }[];
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  banned: boolean;
  created_at: number;
  updated_at: number;
  last_sign_in_at: number | null;
}

export interface userWebhookType {
  data: ClerkUserData;
  type: "user.created" | "user.updated" | "user.deleted";
}
