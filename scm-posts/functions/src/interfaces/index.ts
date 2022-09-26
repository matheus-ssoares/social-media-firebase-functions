export interface Comments {
  id: string;
  content: string;
  user?: {
    id: string;
    name: string;
  };
}
export interface UserNotification {
  action: string;
  body: string;
  deepLink: string;
  title: string;
}
