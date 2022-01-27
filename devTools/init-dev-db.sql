CREATE USER 'grapher' IDENTIFIED BY 'grapher';
GRANT SELECT ON * . * TO 'grapher';
CREATE USER 'wordpress' IDENTIFIED BY 'wordpress';
GRANT SELECT ON * . * TO 'wordpress';
FLUSH PRIVILEGES;