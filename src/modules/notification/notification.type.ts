export type Notification = {
  type: 'custom_notification';
  title: string;
  body?: string;
  [key: string]: string ;
};
