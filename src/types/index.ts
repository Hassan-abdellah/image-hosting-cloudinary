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
