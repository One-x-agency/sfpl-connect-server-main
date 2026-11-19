-- migrate:up

alter table diagram_images add column
original_image_id uuid;

update diagram_images set original_image_id = id;

alter table diagram_images alter column original_image_id set not null;


-- migrate:down

alter table diagram_images drop column original_image_id;
