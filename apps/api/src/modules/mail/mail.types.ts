export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type SendMailInput = {
  to: string;
  actionUrl: string;
};
