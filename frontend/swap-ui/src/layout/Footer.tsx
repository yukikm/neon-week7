import React from 'react';

const Footer = () => {
  return (
    <footer className={'p-2'}>
      <div className={'flex flex-row items-center justify-between'}>
        <div className={'flex flex-row items-center'}>
        </div>
        <div className={'text-gray-800'}>
          NeonLabs &copy; {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
