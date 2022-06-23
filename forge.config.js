module.exports = {
    'packagerConfig': {
        'icon': './icon.icns',
    },
    'makers': [
        {
            'name': '@electron-forge/maker-squirrel',
            'config': {
                'name': 'axis_launcher',
            },
        },
        {
            'name': '@electron-forge/maker-zip',
            'platforms': [
                'darwin',
            ],
        },
        {
            'name': '@electron-forge/maker-deb',
            'config': {},
        },
        {
            'name': '@electron-forge/maker-rpm',
            'config': {},
        },
    ],
};
